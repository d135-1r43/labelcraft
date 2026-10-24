-- Every record, setting and print job belongs to one user: user_id is their
-- OIDC subject. (inventory_item.owner stays the person an asset is assigned to.) Rows from before sign-in existed were the shared samples; every
-- user now gets their own copy on first sign-in, so they go.

delete from contact;
delete from inventory_item;
delete from storage_location;
delete from recipe;
delete from sign;
delete from entity_settings;
delete from print_job;

alter table contact drop constraint contact_pkey;
alter table contact add column user_id varchar(64) not null;
alter table contact add primary key (user_id, id);

alter table inventory_item drop constraint inventory_item_pkey;
alter table inventory_item add column user_id varchar(64) not null;
alter table inventory_item add primary key (user_id, id);

alter table storage_location drop constraint storage_location_pkey;
alter table storage_location add column user_id varchar(64) not null;
alter table storage_location add primary key (user_id, id);

alter table recipe drop constraint recipe_pkey;
alter table recipe add column user_id varchar(64) not null;
alter table recipe add primary key (user_id, id);

alter table sign drop constraint sign_pkey;
alter table sign add column user_id varchar(64) not null;
alter table sign add primary key (user_id, id);

alter table entity_settings drop constraint entity_settings_pkey;
alter table entity_settings add column user_id varchar(64) not null;
alter table entity_settings add primary key (user_id, id);

alter table print_job add column user_id varchar(64) not null;
drop index print_job_created;
create index print_job_user_created on print_job (user_id, created_at desc);

-- Who a user prints as: return address and owner line.
create table profile (
    user_id      varchar(64) primary key,
    name         varchar(300) not null default '',
    company      varchar(300),
    street       varchar(300),
    house_number varchar(40),
    postal_code  varchar(40),
    city         varchar(200),
    region       varchar(100),
    country      char(2) not null default 'DE'
);
