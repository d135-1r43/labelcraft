package net.herhoffer.labeleur.records;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Entity
public class Contact extends RecordEntity
{

	/** “Customers”, “Suppliers” … The column avoids the SQL keyword. */
	@NotNull
	@Column(name = "grp")
	public String group = "";

	/** Shown only in Labeleur, never printed. */
	public String note;

	public String honorific;
	public String title;
	public String givenName;
	public String familyName;
	public String company;
	public String department;
	public String street;
	public String houseNumber;
	/** Second address line: c/o, apartment, Hinterhaus, PO box. */
	public String extra;
	public String postalCode;
	public String city;
	/** State, province or county where the post requires it. */
	public String region;

	/** ISO 3166-1 alpha-2. */
	@NotNull
	@Pattern(regexp = "[A-Z]{2}")
	public String country;
}
