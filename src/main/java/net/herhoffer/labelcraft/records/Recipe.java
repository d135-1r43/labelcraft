package net.herhoffer.labelcraft.records;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Entity;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
public class Recipe extends RecordEntity
{

	@NotNull
	public String name = "";
	@NotNull
	public String category = "";
	@Min(1)
	public int shelfLifeHours;
	@NotNull
	@Pattern(regexp = "chilled|frozen|ambient")
	public String storage;

	/**
	 * EU Regulation 1169/2011 Annex II, by the letter codes German kitchens
	 * use.
	 */
	@NotNull
	@JdbcTypeCode(SqlTypes.JSON)
	public List<@Pattern(regexp = "[A-HLMNOPR]") String> allergens = new ArrayList<>();
}
