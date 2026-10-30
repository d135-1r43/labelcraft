package net.herhoffer.labeleur;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;

@QuarkusTest
class McpSignInTest
{

	@Test
	void mcpNeedsASignedInUser()
	{
		given().contentType("application/json")
			.body("{\"jsonrpc\": \"2.0\", \"id\": 1, \"method\": \"tools/list\"}")
			.post("/mcp").then()
			.statusCode(401);
	}
}
