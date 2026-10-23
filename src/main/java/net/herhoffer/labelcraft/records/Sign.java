package net.herhoffer.labelcraft.records;

import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;

@Entity
public class Sign extends RecordEntity
{

	@NotNull
	public String title = "";
	@NotNull
	public String subtitle = "";
}
