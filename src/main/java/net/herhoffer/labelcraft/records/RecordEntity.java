package net.herhoffer.labelcraft.records;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A working copy of a record. The leading system (CRM, inventory, ERP …) stays
 * the source of truth; {@link #uri} points at the original there.
 */
@MappedSuperclass
public abstract class RecordEntity extends PanacheEntityBase
{

	public static final String ID_PATTERN = "[A-Za-z0-9_-]{1,64}";

	/**
	 * Chosen by the client, so a record exists the moment it is created in the
	 * UI.
	 */
	@Id
	@Pattern(regexp = ID_PATTERN)
	public String id;

	/**
	 * The record in its leading system. Empty when it exists only in
	 * Labelcraft.
	 */
	@Size(max = 2048)
	public String uri;

	/** Keeps lists in the order records were added. */
	@JsonIgnore
	@Column(name = "created_at", nullable = false)
	public Instant createdAt;

	@Column(name = "updated_at")
	public Instant updatedAt;
}
