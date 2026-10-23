package net.herhoffer.labelcraft.organisation;

import java.util.Optional;

import io.smallrye.config.ConfigMapping;

/**
 * Who prints: the return address on address labels, the owner on asset tags.
 */
@ConfigMapping(prefix = "labelcraft.organisation")
public interface Organisation
{

	String name();

	Address address();

	interface Address
	{
		Optional<String> company();

		Optional<String> street();

		Optional<String> houseNumber();

		Optional<String> postalCode();

		Optional<String> city();

		Optional<String> region();

		String country();
	}
}
