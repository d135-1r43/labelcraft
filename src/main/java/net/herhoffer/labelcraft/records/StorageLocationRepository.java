package net.herhoffer.labelcraft.records;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import net.herhoffer.labelcraft.account.OwnedKey;

@ApplicationScoped
public class StorageLocationRepository implements PanacheRepositoryBase<StorageLocation, OwnedKey>
{
}
