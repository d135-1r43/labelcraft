package net.herhoffer.labelcraft.account;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Who a user prints as: the return address on address labels and the owner line
 * on asset tags.
 */
@Entity
public class Profile extends PanacheEntityBase
{
	@Id
	public String userId;

	@NotNull
	@Size(max = 300)
	public String name = "";
	public String company;
	public String street;
	public String houseNumber;
	public String postalCode;
	public String city;
	public String region;

	@NotNull
	@Pattern(regexp = "[A-Z]{2}")
	public String country = "DE";
}
