package net.herhoffer.labelcraft;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
class SettingsResourceTest
{

	@Test
	void everyEntityHasSettings()
	{
		given().get("/api/settings/entities").then()
			.statusCode(200)
			.body("contacts.name", equalTo("CRM"))
			.body("signs.baseUrl", equalTo(""))
			.body("inventory.enabled", equalTo(true));
	}

	@Test
	void switchesAnEntityOffAndBackOn()
	{
		given().contentType(ContentType.JSON).body("{\"enabled\": false, \"name\": \"Kitchen wiki\", \"baseUrl\": \"https://wiki.example/recipes/\"}")
			.put("/api/settings/entities/recipes").then()
			.statusCode(200)
			.body("enabled", equalTo(false));
		given().get("/api/settings/entities").then().body("recipes.name", equalTo("Kitchen wiki"));
		given().contentType(ContentType.JSON).body("{\"enabled\": true, \"name\": \"Recipe book\", \"baseUrl\": \"https://kitchen.nordlicht.de/recipes/\"}")
			.put("/api/settings/entities/recipes").then()
			.statusCode(200);
	}

	@Test
	void rejectsIncompleteAddressesAndUnknownEntities()
	{
		given().contentType(ContentType.JSON).body("{\"enabled\": true, \"name\": \"CRM\", \"baseUrl\": \"crm.nordlicht.de\"}")
			.put("/api/settings/entities/contacts").then()
			.statusCode(400);
		given().contentType(ContentType.JSON).body("{\"enabled\": true, \"name\": \"\", \"baseUrl\": \"\"}")
			.put("/api/settings/entities/spaceships").then()
			.statusCode(404);
	}

	@Test
	void organisationComesFromConfiguration()
	{
		given().get("/api/organisation").then()
			.statusCode(200)
			.body("name", equalTo("Nordlicht Manufaktur GmbH"))
			.body("address.country", equalTo("DE"))
			.body("address.houseNumber", equalTo("88"));
	}
}
