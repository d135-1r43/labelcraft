package net.herhoffer.labelcraft.settings;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Whether an entity is in use, and the leading system its records come from.
 */
@Entity
@Table(name = "entity_settings")
public class EntitySettings extends PanacheEntityBase
{

	/** The collection: contacts, inventory, locations, recipes, signs. */
	@Id
	public String id;

	public boolean enabled;

	/** The leading system's name as people know it: CRM, ERP … */
	@Column(name = "system_name")
	public String name = "";

	/**
	 * Records are linked under this address. Empty: the entity lives only in
	 * Labelcraft.
	 */
	@Column(name = "base_url")
	public String baseUrl = "";
}
