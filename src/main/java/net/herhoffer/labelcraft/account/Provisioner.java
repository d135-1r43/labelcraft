package net.herhoffer.labelcraft.account;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import io.quarkus.logging.Log;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.enterprise.context.ApplicationScoped;
import net.herhoffer.labelcraft.organisation.Organisation;
import net.herhoffer.labelcraft.records.RecordCollections;
import net.herhoffer.labelcraft.seed.SeedData;
import net.herhoffer.labelcraft.settings.EntitySettings;
import net.herhoffer.labelcraft.settings.EntitySettingsRepository;

/**
 * Gives a new user the sample organisation: sender, entity settings and
 * records, so the first screen already has labels on it.
 */
@ApplicationScoped
public class Provisioner
{
	private final Set<String> ready = ConcurrentHashMap.newKeySet();
	private final Map<String, Object> locks = new ConcurrentHashMap<>();

	private final ProfileRepository profiles;
	private final EntitySettingsRepository settings;
	private final RecordCollections collections;
	private final SeedData seed;
	private final Organisation sample;

	Provisioner(ProfileRepository profiles, EntitySettingsRepository settings, RecordCollections collections, SeedData seed, Organisation sample)
	{
		this.profiles = profiles;
		this.settings = settings;
		this.collections = collections;
		this.seed = seed;
		this.sample = sample;
	}

	/**
	 * Idempotent and safe under concurrent first requests; commits before it
	 * returns, so the caller's transaction sees the data.
	 */
	public void ensure(String owner)
	{
		if (ready.contains(owner)) return;
		synchronized (locks.computeIfAbsent(owner, k -> new Object()))
		{
			if (ready.contains(owner)) return;
			QuarkusTransaction.requiringNew().run(() -> provision(owner));
			ready.add(owner);
		}
	}

	private void provision(String owner)
	{
		if (profiles.findById(owner) != null) return;
		Profile p = new Profile();
		p.userId = owner;
		p.name = sample.name();
		var a = sample.address();
		p.company = a.company().orElse(null);
		p.street = a.street().orElse(null);
		p.houseNumber = a.houseNumber().orElse(null);
		p.postalCode = a.postalCode().orElse(null);
		p.city = a.city().orElse(null);
		p.region = a.region().orElse(null);
		p.country = a.country();
		profiles.persist(p);
		for (EntitySettings s : seed.read("settings", EntitySettings.class))
		{
			s.userId = owner;
			settings.persist(s);
		}
		for (var c : collections.all())
			seed.insert(c, owner);
		Log.infof("Set up sample data for a new user");
	}
}
