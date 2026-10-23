package net.herhoffer.labelcraft.records;

import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;

/**
 * One kind of record, as the API and the seed data name it: contacts, inventory
 * …
 */
public record RecordCollection<T extends RecordEntity>(String id, Class<T> type, PanacheRepositoryBase<T, String> repository)
{

	public List<T> listInOrder()
	{
		return repository.listAll(Sort.by("createdAt").and("id"));
	}
}
