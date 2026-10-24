package net.herhoffer.labeleur.keycloak;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EmailAllowlistTest
{
	@Test
	void emptyListAllowsEveryone()
	{
		assertTrue(new EmailAllowlist(null).allows("anyone@anywhere.org"));
		assertTrue(new EmailAllowlist("  ").allows("anyone@anywhere.org"));
	}

	@Test
	void allowsListedAddressesAndDomains()
	{
		EmailAllowlist list = new EmailAllowlist("Markus@Herhoffer.net, @explore.de;ops@example.org");
		assertTrue(list.allows("markus@herhoffer.net"));
		assertTrue(list.allows(" MARKUS@herhoffer.net "));
		assertTrue(list.allows("anna@explore.de"));
		assertTrue(list.allows("ops@example.org"));
		assertFalse(list.allows("someone@herhoffer.net"));
		assertFalse(list.allows("anna@sub.explore.de"));
		assertFalse(list.allows("anna@explore.de.evil.com"));
		assertFalse(list.allows("ops@example.org.evil.com"));
		assertFalse(list.allows("not-an-address"));
		assertFalse(list.allows(null));
	}
}
