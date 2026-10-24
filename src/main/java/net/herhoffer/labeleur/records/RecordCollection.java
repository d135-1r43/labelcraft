package net.herhoffer.labeleur.records;

import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Sort;
import net.herhoffer.labeleur.account.OwnedKey;

/**
 * One kind of record, as the API and the seed data name it: contacts, inventory
 * …
 */
public record RecordCollection<T extends RecordEntity>(String id, Class<T> type, PanacheRepositoryBase<T, OwnedKey> repository)
{

	public List<T> listInOrder(String owner)
	{
		return repository.list("userId", Sort.by("createdAt").and("id"), owner);
	}

	public T find(String owner, String id)
	{
		return repository.findById(new OwnedKey(owner, id));
	}

	public boolean delete(String owner, String id)
	{
		return repository.deleteById(new OwnedKey(owner, id));
	}

	public long deleteAll(String owner)
	{
		return repository.delete("userId", owner);
	}
}
