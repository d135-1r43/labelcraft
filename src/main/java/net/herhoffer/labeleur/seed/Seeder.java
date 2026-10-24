package net.herhoffer.labeleur.seed;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.transaction.Transactional;
import net.herhoffer.labeleur.printing.Printer;
import net.herhoffer.labeleur.printing.PrinterRepository;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Fills the shared printer list on a fresh database. Each user's own records
 * come from {@link net.herhoffer.labeleur.account.Provisioner} on their first
 * request.
 */
@ApplicationScoped
public class Seeder
{
	private final SeedData seed;
	private final PrinterRepository printers;
	private final boolean enabled;

	Seeder(SeedData seed, PrinterRepository printers, @ConfigProperty(name = "labeleur.seed-on-start") boolean enabled)
	{
		this.seed = seed;
		this.printers = printers;
		this.enabled = enabled;
	}

	@Transactional
	void onStart(@Observes StartupEvent ev)
	{
		if (enabled && printers.count() == 0) seed.read("printers", Printer.class).forEach(printers::persist);
	}
}
