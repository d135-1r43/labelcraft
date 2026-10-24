package net.herhoffer.labelcraft;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
@TestSecurity(user = "alice")
class RecordResourceTest
{

	@Test
	void listsSeededRecordsWithTheirLinks()
	{
		given().get("/api/records/contacts").then()
			.statusCode(200)
			.body("size()", greaterThan(10))
			.body("[0].uri", notNullValue())
			.body("[0].createdAt", nullValue())
			.body("find { it.id == 'c1' }.group", equalTo("Customers"))
			// Optional fields are left out, not sent as null.
			.body("find { it.id == 'c2' }", not(org.hamcrest.Matchers.hasKey("company")));
	}

	@Test
	void createsUpdatesAndRemovesARecord()
	{
		String body = """
			{"assetTag": "NL-999001", "name": "Test drill", "category": "Tools", "location": "Bench", "uri": "https://inv.nordlicht.de/a/NL-999001"}
			""";
		given().contentType(ContentType.JSON).body(body).put("/api/records/inventory/inv-test-1").then()
			.statusCode(200)
			.body("id", equalTo("inv-test-1"))
			.body("updatedAt", notNullValue());
		given().get("/api/records/inventory").then().body("id", hasItem("inv-test-1"));

		given().contentType(ContentType.JSON).body(body.replace("Test drill", "Test drill, cordless")).put("/api/records/inventory/inv-test-1").then()
			.statusCode(200)
			.body("name", equalTo("Test drill, cordless"));

		given().delete("/api/records/inventory/inv-test-1").then().statusCode(204);
		given().get("/api/records/inventory").then().body("id", not(hasItem("inv-test-1")));
		given().delete("/api/records/inventory/inv-test-1").then().statusCode(404);
	}

	@Test
	void storesStructuredFieldsAsJson()
	{
		given().contentType(ContentType.JSON)
			.body("""
				{"segments": [{"label": "aisle", "value": "Z"}, {"label": "rack", "value": "9"}], "area": "Test", "contents": "Spare fuses", "arrow": "up"}
				""")
			.put("/api/records/locations/loc-test-1").then()
			.statusCode(200)
			.body("segments[1].value", equalTo("9"));
		given().delete("/api/records/locations/loc-test-1").then().statusCode(204);
	}

	@Test
	void rejectsInvalidRecords()
	{
		given().contentType(ContentType.JSON).body("{\"country\": \"Germany\"}").put("/api/records/contacts/con-bad").then()
			.statusCode(400)
			.body("fields.country", notNullValue());
		given().contentType(ContentType.JSON).body("{\"name\": \"x\", \"storage\": \"warm\", \"shelfLifeHours\": 4}").put("/api/records/recipes/rec-bad").then()
			.statusCode(400)
			.body("fields.storage", notNullValue());
		given().contentType(ContentType.JSON).body("{\"title\": \"x\"}").put("/api/records/signs/has spaces").then().statusCode(400);
	}

	@Test
	void unknownCollectionIsNotFound()
	{
		given().get("/api/records/spaceships").then().statusCode(404);
	}

	@Test
	void resetRestoresTheSamples()
	{
		given().contentType(ContentType.JSON).body("{\"title\": \"Temporary\", \"subtitle\": \"\"}").put("/api/records/signs/sig-temp").then().statusCode(200);
		given().post("/api/records/signs/reset").then()
			.statusCode(200)
			.body("size()", equalTo(4))
			.body("id", not(hasItem("sig-temp")))
			.body("[0].title", equalTo("Vorsicht, zerbrechlich"));
	}
}
