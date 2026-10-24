-- Which collections a user has had the samples for. Users from before boxes
-- existed get the box samples on their next sign-in.
alter table profile add column seeded jsonb not null default '[]';
update profile set seeded = '["contacts", "inventory", "locations", "recipes", "signs"]';
