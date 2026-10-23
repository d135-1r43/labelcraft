package net.herhoffer.labelcraft.records;

import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Entity
public class InventoryItem extends RecordEntity
{

	@NotNull
	public String assetTag = "";
	@NotNull
	public String name = "";
	@NotNull
	public String category = "";
	public String model;
	public String serial;
	@NotNull
	public String location = "";
	public String owner;
	/** ISO date, as the inventory reports it. */
	@Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}")
	public String purchased;
}
