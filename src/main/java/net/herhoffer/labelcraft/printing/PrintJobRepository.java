package net.herhoffer.labelcraft.printing;

import java.util.List;
import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import io.quarkus.panache.common.Page;
import io.quarkus.panache.common.Sort;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class PrintJobRepository implements PanacheRepositoryBase<PrintJob, UUID>
{

	public List<PrintJob> recent(String owner, int count)
	{
		return find("userId", Sort.descending("createdAt"), owner).page(Page.ofSize(count)).list();
	}

	public PrintJob findOwned(String owner, UUID id)
	{
		return find("userId = ?1 and id = ?2", owner, id).firstResult();
	}
}
