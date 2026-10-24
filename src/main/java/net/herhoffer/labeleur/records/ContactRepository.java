package net.herhoffer.labeleur.records;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import net.herhoffer.labeleur.account.OwnedKey;

@ApplicationScoped
public class ContactRepository implements PanacheRepositoryBase<Contact, OwnedKey>
{
}
