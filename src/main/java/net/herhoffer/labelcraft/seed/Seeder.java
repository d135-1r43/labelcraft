package net.herhoffer.labelcraft.seed;

import io.quarkus.logging.Log;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import net.herhoffer.labelcraft.printing.Printer;
import net.herhoffer.labelcraft.printing.PrinterRepository;
import net.herhoffer.labelcraft.records.RecordCollections;
import net.herhoffer.labelcraft.settings.EntitySettings;
import net.herhoffer.labelcraft.settings.EntitySettingsRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Fills empty tables with sample data, so a fresh install has something to
 * print.
 */
@ApplicationScoped
public class Seeder
{

	private final SeedData seed;
	private final RecordCollections collections;
	private final EntitySettingsRepository settings;
	private final PrinterRepository printers;
	private final boolean enabled;

	Seeder(SeedData seed, RecordCollections collections, EntitySettingsRepository settings, PrinterRepository printers, @ConfigProperty(name = "labelcraft.seed-on-start") boolean enabled)
	{
		this.seed = seed;
		this.collections = collections;
		this.settings = settings;
		this.printers = printers;
		this.enabled = enabled;
	}

	@Transactional
	void onStart(@Observes StartupEvent ev)
	{
		if (!enabled) return;
		for (var c : collections.all())
		{
			if (c.repository().count() == 0)
			{
				seed.insert(c);
				Log.infof("Seeded %s", c.id());
			}
		}
		// Settings are per entity: add a row for any entity that has none,
		// never overwrite.
		for (EntitySettings s : seed.read("settings", EntitySettings.class))
		{
			if (settings.findById(s.id) == null) settings.persist(s);
		}
		if (printers.count() == 0) seed.read("printers", Printer.class).forEach(printers::persist);
	}
}
