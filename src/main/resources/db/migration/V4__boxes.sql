-- Boxes and cases, and what is packed in them.
create table box (
    user_id    varchar(64) not null,
    id         varchar(64) not null,
    uri        varchar(2048),
    created_at timestamptz not null,
    updated_at timestamptz,
    number     varchar(40) not null default '',
    title      varchar(300) not null default '',
    location   varchar(200) not null default '',
    items      jsonb not null default '[]',
    primary key (user_id, id)
);

-- The logo printed on box labels, as uploaded.
alter table profile add column logo bytea;
alter table profile add column logo_type varchar(100);
alter table profile add column logo_updated_at timestamptz;
