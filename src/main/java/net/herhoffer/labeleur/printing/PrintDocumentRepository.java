package net.herhoffer.labeleur.printing;

import java.util.UUID;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class PrintDocumentRepository implements PanacheRepositoryBase<PrintDocument, UUID>
{
}
