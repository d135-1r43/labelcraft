package net.herhoffer.labeleur.seed;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import net.herhoffer.labeleur.records.RecordCollection;
import net.herhoffer.labeleur.records.RecordEntity;

/** The sample organisation's data, from {@code src/main/resources/seed}. */
@ApplicationScoped
public class SeedData
{

	private final ObjectMapper mapper;

	SeedData(ObjectMapper mapper)
	{
		this.mapper = mapper;
	}

	public <T> List<T> read(String name, Class<T> type)
	{
		try (InputStream in = Thread.currentThread().getContextClassLoader().getResourceAsStream("seed/" + name + ".json"))
		{
			if (in == null) throw new IllegalStateException("Missing seed/" + name + ".json");
			return mapper.readerForListOf(type).readValue(in);
		}
		catch (IOException e)
		{
			throw new UncheckedIOException(e);
		}
	}

	/** A sample file as it is, such as the sample logo. */
	public byte[] bytes(String name)
	{
		try (InputStream in = Thread.currentThread().getContextClassLoader().getResourceAsStream("seed/" + name))
		{
			if (in == null) throw new IllegalStateException("Missing seed/" + name);
			return in.readAllBytes();
		}
		catch (IOException e)
		{
			throw new UncheckedIOException(e);
		}
	}

	/**
	 * Insert a collection's samples for a user, keeping their order. A sample
	 * whose id the user already has is left out, so their record stays as it
	 * is. Call inside a transaction.
	 */
	public <T extends RecordEntity> void insert(RecordCollection<T> c, String owner)
	{
		Instant base = Instant.now();
		List<T> recs = read(c.id(), c.type());
		for (int i = 0; i < recs.size(); i++)
		{
			T r = recs.get(i);
			if (c.find(owner, r.id) != null) continue;
			r.userId = owner;
			r.createdAt = base.plusMillis(i);
			c.repository().persist(r);
		}
	}
}
