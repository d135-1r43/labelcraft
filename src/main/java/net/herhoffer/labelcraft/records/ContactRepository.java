package net.herhoffer.labelcraft.records;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class ContactRepository implements PanacheRepositoryBase<Contact, String>
{
}
