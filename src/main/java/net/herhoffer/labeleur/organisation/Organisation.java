package net.herhoffer.labeleur.organisation;

import java.util.Optional;

import io.smallrye.config.ConfigMapping;

/**
 * The sample organisation every new user starts with as their sender (see
 * {@link net.herhoffer.labeleur.account.Provisioner}).
 */
@ConfigMapping(prefix = "labeleur.organisation")
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
