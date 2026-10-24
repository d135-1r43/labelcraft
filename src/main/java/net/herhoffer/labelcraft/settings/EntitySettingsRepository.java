package net.herhoffer.labelcraft.settings;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import net.herhoffer.labelcraft.account.OwnedKey;

@ApplicationScoped
public class EntitySettingsRepository implements PanacheRepositoryBase<EntitySettings, OwnedKey>
{
}
