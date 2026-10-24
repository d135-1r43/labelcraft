package net.herhoffer.labeleur.settings;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import net.herhoffer.labeleur.account.OwnedKey;

/**
 * Whether an entity is in use for a user, and the leading system its records
 * come from.
 */
@Entity
@Table(name = "entity_settings")
@IdClass(OwnedKey.class)
public class EntitySettings extends PanacheEntityBase
{

	@Id
	@JsonIgnore
	public String userId;

	/**
	 * The collection: contacts, inventory, locations, recipes, signs, boxes.
	 */
	@Id
	public String id;

	public boolean enabled;

	/** The leading system's name as people know it: CRM, ERP … */
	@Column(name = "system_name")
	public String name = "";

	/**
	 * Records are linked under this address. Empty: the entity lives only in
	 * Labeleur.
	 */
	@Column(name = "base_url")
	public String baseUrl = "";
}
