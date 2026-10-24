package net.herhoffer.labeleur.records;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** A road case or box that travels, and what is packed in it. */
@Entity
public class Box extends RecordEntity
{

	@NotNull
	@Size(max = 300)
	public String title = "";

	/** One line per thing packed, in the order it is listed on the label. */
	@NotNull
	@Size(max = 200)
	@JdbcTypeCode(SqlTypes.JSON)
	public List<@NotNull @Size(max = 300) String> items = new ArrayList<>();
}
