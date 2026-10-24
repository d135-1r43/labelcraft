package net.herhoffer.labeleur.account;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Who a user prints as: the return address on address labels and the owner line
 * on asset tags, and the owner and logo on box labels.
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

	/** The collections this user has had the samples for. */
	@JdbcTypeCode(SqlTypes.JSON)
	public List<String> seeded = new ArrayList<>();

	/** Printed on box labels; any image the browser can draw. */
	public byte[] logo;
	public String logoType;
	public Instant logoUpdatedAt;
}
