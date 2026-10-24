package net.herhoffer.labelcraft;

import java.util.Base64;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class AccountTest
{
	@Test
	void signedOutRequestsAreRefused()
	{
		given().get("/api/records/contacts").then().statusCode(401);
		given().get("/api/me").then().statusCode(401);
	}

	@Test
	@TestSecurity(user = "carol")
	void aNewUserStartsWithTheSamples()
	{
		given().get("/api/me").then().statusCode(200).body("id", equalTo("carol")).body("logoutUrl", equalTo("/logout"));
		given().get("/api/records/inventory").then().statusCode(200).body("size()", greaterThan(10));
		given().get("/api/organisation").then().statusCode(200).body("name", equalTo("Nordlicht Manufaktur GmbH"));
	}

	@Test
	@TestSecurity(user = "dave")
	void eachUserSeesOnlyTheirOwnRecords()
	{
		given().contentType(ContentType.JSON).body("{\"title\": \"Dave's shelf\", \"subtitle\": \"\"}").put("/api/records/signs/sig-dave").then().statusCode(200);
		given().contentType(ContentType.JSON).body("{\"title\": \"Dave's t1\", \"subtitle\": \"\"}").put("/api/records/signs/t1").then().statusCode(200);
		given().get("/api/records/signs").then().body("title", hasItem("Dave's shelf"));
	}

	@Test
	@TestSecurity(user = "erin")
	void anotherUsersRecordsStayInvisible()
	{
		given().get("/api/records/signs").then()
			.statusCode(200)
			.body("title", not(hasItem("Dave's shelf")))
			.body("find { it.id == 't1' }.title", equalTo("Vorsicht, zerbrechlich"));
		// Same id as Dave's record, but Erin's own: deleting it leaves Dave's
		// alone.
		given().delete("/api/records/signs/sig-dave").then().statusCode(404);
	}

	@Test
	@TestSecurity(user = "frank")
	void changesTheSender()
	{
		given().contentType(ContentType.JSON)
			.body("{\"name\": \"Frank Feld\", \"address\": {\"street\": \"Hauptstraße\", \"houseNumber\": \"1\", \"postalCode\": \"10115\", \"city\": \"Berlin\", \"country\": \"DE\"}}")
			.put("/api/organisation").then()
			.statusCode(200)
			.body("name", equalTo("Frank Feld"));
		given().get("/api/organisation").then().body("address.city", equalTo("Berlin"));
		given().contentType(ContentType.JSON).body("{\"name\": \"x\", \"address\": {\"country\": \"Germany\"}}").put("/api/organisation").then().statusCode(400);
	}

	@Test
	@TestSecurity(user = "judy")
	void aNewUserStartsWithTheSampleLogo()
	{
		given().get("/api/organisation").then().statusCode(200).body("logoUpdatedAt", notNullValue());
		given().get("/api/organisation/logo").then().statusCode(200).contentType("image/svg+xml");
	}

	@Test
	@TestSecurity(user = "grace")
	void uploadsAndRemovesTheLogo()
	{
		byte[] png = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==");
		given().contentType("image/png").body(png).put("/api/organisation/logo").then().statusCode(200).body("logoUpdatedAt", notNullValue());
		given().get("/api/organisation/logo").then().statusCode(200).contentType("image/png").header("Content-Security-Policy", containsString("sandbox"));
		given().contentType("application/pdf").body(png).put("/api/organisation/logo").then().statusCode(415);
		given().delete("/api/organisation/logo").then().statusCode(200).body("logoUpdatedAt", nullValue());
		given().get("/api/organisation/logo").then().statusCode(404);
	}

	@Test
	@TestSecurity(user = "heidi")
	void keepsBoxesAndTheirContents()
	{
		given().get("/api/records/boxes").then().statusCode(200).body("find { it.id == 'b2' }.items", hasItem("Shure SM58 (6)"));
		given().contentType(ContentType.JSON)
			.body("{\"title\": \"Merch\", \"items\": [\"Shirts\", \"Kartenleser\"]}")
			.put("/api/records/boxes/box-merch")
			.then()
			.statusCode(200);
		given().get("/api/records/boxes").then().body("find { it.id == 'box-merch' }.items", contains("Shirts", "Kartenleser"));
	}
}
