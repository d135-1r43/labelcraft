package net.herhoffer.labeleur.printing;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

/**
 * A Brother QL printer and the roll it reports as loaded. Simulated until
 * printers are driven directly.
 */
@Entity
public class Printer extends PanacheEntityBase
{

	@Id
	public String id;
	public String name;
	public String model;
	public String location;
	/** Wi-Fi, USB, Ethernet. */
	public String connection;
	/** ready, printing, offline, cover-open, no-media. */
	public String status;
	@Column(name = "loaded_media")
	public String loadedMedia;
	/**
	 * Remaining length on continuous rolls, or labels left on die-cut rolls.
	 */
	public String remaining;
}
