package net.herhoffer.labeleur.settings;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import net.herhoffer.labeleur.account.OwnedKey;

@ApplicationScoped
public class EntitySettingsRepository implements PanacheRepositoryBase<EntitySettings, OwnedKey>
{
}
