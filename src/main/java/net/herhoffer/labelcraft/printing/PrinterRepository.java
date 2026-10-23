package net.herhoffer.labelcraft.printing;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class PrinterRepository implements PanacheRepositoryBase<Printer, String>
{
}
