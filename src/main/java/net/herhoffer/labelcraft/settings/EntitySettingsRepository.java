package net.herhoffer.labelcraft.settings;

import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class EntitySettingsRepository implements PanacheRepositoryBase<EntitySettings, String>
{
}
