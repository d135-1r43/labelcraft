-- Cases travel: they have a name and contents, no shelf number or place.
alter table box drop column number;
alter table box drop column location;

-- The first samples were household boxes; users get the road-case samples instead.
delete from box where id in ('b1', 'b2', 'b3', 'b4');
update profile set seeded = seeded - 'boxes';
