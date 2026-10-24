package net.herhoffer.labelcraft.records;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Entity;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
public class StorageLocation extends RecordEntity
{

	/**
	 * One level of the location code, coarse to fine: aisle A, rack 03, shelf
	 * 2.
	 */
	public record Segment(@NotNull String label, @NotNull String value)
	{
	}

	@NotNull
	@Size(min = 1, max = 4)
	@JdbcTypeCode(SqlTypes.JSON)
	public List<@Valid Segment> segments = new ArrayList<>();

	@NotNull
	public String area = "";
	@NotNull
	public String contents = "";
	/** Where the shelf is, seen from the label. */
	@Pattern(regexp = "up|down|left|right")
	public String arrow;
	public String sku;
}
