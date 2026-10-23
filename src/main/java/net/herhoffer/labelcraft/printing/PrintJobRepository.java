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

	public List<PrintJob> recent(int count)
	{
		return findAll(Sort.descending("createdAt")).page(Page.ofSize(count)).list();
	}
}
