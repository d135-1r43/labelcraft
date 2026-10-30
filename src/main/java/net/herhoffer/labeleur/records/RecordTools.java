package net.herhoffer.labeleur.records;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.vertx.http.runtime.CurrentVertxRequest;
import jakarta.validation.ConstraintViolationException;

/**
 * The records over MCP, for clients like Claude Code: the same collections the
 * REST API serves, as the user the access token belongs to.
 */
public class RecordTools
{

	/** What each collection holds and the fields a record takes. */
	static final Map<String, String> COLLECTIONS = new LinkedHashMap<>();
	static
	{
		COLLECTIONS.put("signs", "Signs: a title and a smaller subtitle. Fields: title, subtitle.");
		COLLECTIONS.put("boxes", "Road cases and boxes with a packing list. Fields: title (max 300), items (list of strings, one per thing packed, max 200).");
		COLLECTIONS.put("contacts", "Address labels. Fields: group (required, e.g. \"Customers\", \"Suppliers\"), country (required, ISO 3166-1 alpha-2 like \"DE\"), honorific, title, givenName, familyName, company, department, street, houseNumber, extra (c/o, apartment, PO box), postalCode, city, region, note (shown only in Labeleur, never printed).");
		COLLECTIONS.put("inventory", "Asset tags. Fields: assetTag, name, category, location, model, serial, owner, purchased (YYYY-MM-DD).");
		COLLECTIONS.put("locations", "Shelf and storage location labels. Fields: segments (1 to 4 of {label, value}, coarse to fine, e.g. aisle A, rack 03, shelf 2), area, contents, arrow (up, down, left or right: where the shelf is, seen from the label), sku.");
		COLLECTIONS.put("recipes", "Kitchen prep labels. Fields: name, category, shelfLifeHours (at least 1), storage (chilled, frozen or ambient), allergens (EU 1169/2011 letter codes: A-H, L, M, N, O, P, R).");
	}

	/** Records as one JSON object, not one MCP content per record. */
	public record Found(List<? extends RecordEntity> records)
	{
	}

	/** A record with the link that opens it on its label in Labeleur. */
	public record Saved(String link, RecordEntity record)
	{
	}

	private final RecordService records;
	private final RecordCollections collections;
	private final ObjectMapper mapper;
	private final CurrentVertxRequest request;

	RecordTools(RecordService records, RecordCollections collections, ObjectMapper mapper, CurrentVertxRequest request)
	{
		this.records = records;
		this.collections = collections;
		this.mapper = mapper;
		this.request = request;
	}

	@Tool(name = "list_collections", description = "The kinds of labels Labeleur keeps, one collection each, with the fields their records take. Call it before creating a record. Printing happens in the Labeleur web app: open a record's link there.")
	Map<String, String> listCollections()
	{
		return COLLECTIONS;
	}

	@Tool(name = "list_records", description = "The user's records in a collection, in the order they were added, each with its id.")
	Found listRecords(@ToolArg(description = "signs, boxes, contacts, inventory, locations or recipes") String collection, @ToolArg(description = "Only records containing this text, ignoring case") Optional<String> search)
	{
		List<? extends RecordEntity> all = records.list(known(collection));
		if (search.isEmpty() || search.get().isBlank()) return new Found(all);
		String needle = search.get().toLowerCase(Locale.ROOT);
		return new Found(all.stream().filter(r -> mapper.valueToTree(r).toString().toLowerCase(Locale.ROOT).contains(needle)).toList());
	}

	@Tool(name = "get_record", description = "One record and the link that opens it on its label in Labeleur.")
	Saved getRecord(@ToolArg(description = "signs, boxes, contacts, inventory, locations or recipes") String collection, @ToolArg(description = "The record's id") String id)
	{
		return saved(collection, existing(collection, id));
	}

	@Tool(name = "save_record", description = "Create a record, or change fields of an existing one: fields left out keep their value. Returns the record and the link that opens it on its label in Labeleur, where it can be printed. See list_collections for the fields.")
	Saved saveRecord(@ToolArg(description = "signs, boxes, contacts, inventory, locations or recipes") String collection, @ToolArg(description = "The record to change; leave out to create a new one") Optional<String> id, @ToolArg(description = "The fields to set, e.g. {\"title\": \"Kitchen\", \"subtitle\": \"Staff only\"}") Map<String, Object> fields)
	{
		known(collection);
		String key = id.filter(s -> !s.isBlank()).orElseGet(() -> newId(collection));
		RecordEntity current = records.find(collection, key);
		ObjectNode body = current == null ? mapper.createObjectNode() : mapper.valueToTree(current);
		body.setAll(mapper.<ObjectNode> valueToTree(fields));
		try
		{
			return saved(collection, records.put(collection, key, body));
		}
		catch (ConstraintViolationException e)
		{
			throw new ToolCallException("Some fields are not valid: " + e.getConstraintViolations().stream()
				.map(v -> v.getPropertyPath() + " " + v.getMessage())
				.sorted()
				.collect(Collectors.joining("; ")));
		}
		catch (IllegalArgumentException e)
		{
			throw new ToolCallException("The fields don't fit a record in " + collection + ": " + e.getMessage());
		}
	}

	@Tool(name = "delete_record", description = "Remove Labeleur's copy of a record. The original in its leading system (CRM, inventory …) stays.")
	String deleteRecord(@ToolArg(description = "signs, boxes, contacts, inventory, locations or recipes") String collection, @ToolArg(description = "The record's id") String id)
	{
		existing(collection, id);
		records.delete(collection, id);
		return "Deleted " + collection + "/" + id;
	}

	private RecordEntity existing(String collection, String id)
	{
		RecordEntity r = records.find(known(collection), id);
		if (r == null) throw new ToolCallException("No record " + id + " in " + collection);
		return r;
	}

	private Saved saved(String collection, RecordEntity r)
	{
		URI uri = URI.create(request.getCurrent().request().absoluteURI());
		String origin = uri.getScheme() + "://" + uri.getRawAuthority();
		return new Saved(origin + "/r/" + collection + "/" + r.id, r);
	}

	/**
	 * Like the web app's ids: the collection's first letters, then time and
	 * chance.
	 */
	private String newId(String collection)
	{
		String random = Long.toString(ThreadLocalRandom.current().nextLong(36 * 36 * 36), 36);
		return collection.substring(0, 3) + "-" + Long.toString(System.currentTimeMillis(), 36) + random;
	}

	private String known(String collection)
	{
		if (!collections.exists(collection)) throw new ToolCallException("No collection named " + collection + ". Use one of " + String.join(", ", COLLECTIONS.keySet()));
		return collection;
	}
}
