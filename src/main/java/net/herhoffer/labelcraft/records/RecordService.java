package net.herhoffer.labelcraft.records;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import jakarta.ws.rs.NotFoundException;
import net.herhoffer.labelcraft.seed.SeedData;

@ApplicationScoped
public class RecordService
{

	private final RecordCollections collections;
	private final ObjectMapper mapper;
	private final Validator validator;
	private final SeedData seed;

	RecordService(RecordCollections collections, ObjectMapper mapper, Validator validator, SeedData seed)
	{
		this.collections = collections;
		this.mapper = mapper;
		this.validator = validator;
		this.seed = seed;
	}

	public List<? extends RecordEntity> list(String collection)
	{
		return collections.get(collection).listInOrder();
	}

	/**
	 * Create or replace a record. The id in the path wins over one in the body.
	 */
	@Transactional
	public RecordEntity put(String collection, String id, ObjectNode body)
	{
		return put(collections.get(collection), id, body);
	}

	private <T extends RecordEntity> T put(RecordCollection<T> c, String id, ObjectNode body)
	{
		body.remove(List.of("id", "createdAt", "updatedAt"));
		T incoming = mapper.convertValue(body, c.type());
		incoming.id = id;
		var violations = validator.validate(incoming);
		if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
		T existing = c.repository().findById(id);
		Instant now = Instant.now();
		incoming.createdAt = existing != null ? existing.createdAt : now;
		incoming.updatedAt = now;
		return c.repository().getEntityManager().merge(incoming);
	}

	@Transactional
	public void delete(String collection, String id)
	{
		if (!collections.get(collection).repository().deleteById(id)) throw new NotFoundException();
	}

	/** Replace a collection with the sample records. */
	@Transactional
	public List<? extends RecordEntity> reset(String collection)
	{
		RecordCollection<?> c = collections.get(collection);
		c.repository().deleteAll();
		c.repository().flush();
		seed.insert(c);
		return c.listInOrder();
	}
}
