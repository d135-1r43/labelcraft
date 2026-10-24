package net.herhoffer.labeleur.records;

import java.util.List;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestPath;

/**
 * Contacts, inventory, locations, recipes and signs, under one shape of API.
 */
@Path("/records/{collection}")
@Tag(name = "Records")
public class RecordResource
{

	private final RecordService records;

	RecordResource(RecordService records)
	{
		this.records = records;
	}

	@GET
	@Operation(summary = "All records of a collection, in the order they were added")
	public List<? extends RecordEntity> list(@RestPath String collection)
	{
		return records.list(collection);
	}

	@PUT
	@Path("/{id}")
	@Operation(summary = "Create or replace a record")
	public RecordEntity put(@RestPath String collection, @RestPath @Pattern(regexp = RecordEntity.ID_PATTERN) String id, @NotNull ObjectNode body)
	{
		return records.put(collection, id, body);
	}

	/**
	 * The same as PUT, for {@code navigator.sendBeacon}, which can only POST:
	 * saves edits as the page closes.
	 */
	@POST
	@Path("/{id}")
	@Operation(summary = "Create or replace a record (POST form of PUT)")
	public RecordEntity post(@RestPath String collection, @RestPath @Pattern(regexp = RecordEntity.ID_PATTERN) String id, @NotNull ObjectNode body)
	{
		return records.put(collection, id, body);
	}

	@DELETE
	@Path("/{id}")
	@Operation(summary = "Remove Labeleur's copy; the original in the leading system stays")
	public void delete(@RestPath String collection, @RestPath String id)
	{
		records.delete(collection, id);
	}

	@POST
	@Path("/reset")
	@Operation(summary = "Replace the collection with the sample records")
	public List<? extends RecordEntity> reset(@RestPath String collection)
	{
		return records.reset(collection);
	}
}
