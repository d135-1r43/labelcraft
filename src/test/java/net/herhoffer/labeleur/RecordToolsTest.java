package net.herhoffer.labeleur;

import java.util.List;
import java.util.Map;

import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkiverse.mcp.server.test.McpAssured;
import io.quarkiverse.mcp.server.test.McpAssured.McpStreamableTestClient;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

@QuarkusTest
@TestSecurity(user = "mcp-user")
class RecordToolsTest
{

	private McpStreamableTestClient client;

	@BeforeEach
	void connect()
	{
		client = McpAssured.newConnectedStreamableClient();
	}

	@AfterEach
	void disconnect()
	{
		client.disconnect();
	}

	@Test
	void offersTheRecordTools()
	{
		client.when()
			.toolsList(page -> assertThat(page.tools()).extracting(McpAssured.ToolInfo::name)
				.containsExactlyInAnyOrder("list_collections", "list_records", "get_record", "save_record", "delete_record"))
			.thenAssertResults();
	}

	@Test
	void describesTheCollections()
	{
		client.when()
			.toolsCall("list_collections", Map.of(), r -> assertThat(json(r).getMap("")).containsKeys("signs", "boxes", "contacts", "inventory", "locations", "recipes"))
			.thenAssertResults();
	}

	@Test
	void createsChangesAndDeletesARecordAsTheSignedInUser()
	{
		String[] id = new String[1];
		client.when()
			.toolsCall("save_record", Map.of("collection", "signs", "fields", Map.of("title", "Kitchen", "subtitle", "Staff only")), r -> {
				assertThat(r.isError()).isFalse();
				JsonPath saved = json(r);
				id[0] = saved.getString("record.id");
				assertThat(id[0]).startsWith("sig-");
				assertThat(saved.getString("link")).endsWith("/r/signs/" + id[0]);
			})
			.thenAssertResults();

		// The REST API shows it to the same user.
		given().get("/api/records/signs").then().body("find { it.id == '" + id[0] + "' }.title", equalTo("Kitchen"));

		// One call per round trip: a batch sends them all before any answers.
		client.when()
			.toolsCall("save_record", Map.of("collection", "signs", "id", id[0], "fields", Map.of("subtitle", "Please knock")), r -> {
				assertThat(json(r).getString("record.title")).isEqualTo("Kitchen");
				assertThat(json(r).getString("record.subtitle")).isEqualTo("Please knock");
			})
			.thenAssertResults();
		client.when()
			.toolsCall("list_records", Map.of("collection", "signs", "search", "please KNOCK"), r -> assertThat(json(r).getList("records.id")).containsExactly(id[0]))
			.thenAssertResults();
		client.when()
			.toolsCall("delete_record", Map.of("collection", "signs", "id", id[0]), r -> assertThat(r.isError()).isFalse())
			.thenAssertResults();
		client.when()
			.toolsCall("get_record", Map.of("collection", "signs", "id", id[0]), r -> assertThat(r.isError()).isTrue())
			.thenAssertResults();
	}

	@Test
	void savesStructuredFields()
	{
		client.when()
			.toolsCall("save_record", Map.of("collection", "boxes", "id", "box-mcp-1", "fields", Map.of("title", "Case 7", "items", List.of("Stage box", "XLR 10 m"))), r -> assertThat(json(r).getList("record.items")).containsExactly("Stage box", "XLR 10 m"))
			.thenAssertResults();
		client.when()
			.toolsCall("delete_record", Map.of("collection", "boxes", "id", "box-mcp-1"), r -> assertThat(r.isError()).isFalse())
			.thenAssertResults();
	}

	@Test
	void explainsWhatIsWrong()
	{
		client.when()
			.toolsCall("save_record", Map.of("collection", "labels", "fields", Map.of("title", "x")), r -> {
				assertThat(r.isError()).isTrue();
				assertThat(r.firstContent().asText().text()).contains("No collection named labels", "signs");
			})
			.toolsCall("save_record", Map.of("collection", "contacts", "fields", Map.of("group", "Customers", "country", "Germany")), r -> {
				assertThat(r.isError()).isTrue();
				assertThat(r.firstContent().asText().text()).contains("country");
			})
			.toolsCall("delete_record", Map.of("collection", "signs", "id", "no-such-sign"), r -> assertThat(r.isError()).isTrue())
			.thenAssertResults();
	}

	private static JsonPath json(ToolResponse r)
	{
		return JsonPath.from(r.firstContent().asText().text());
	}
}
