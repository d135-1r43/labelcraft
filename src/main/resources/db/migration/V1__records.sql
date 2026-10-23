-- Labelcraft keeps working copies of records. Each one carries the URI of
-- its original in the leading system (CRM, inventory, ERP …).

create table contact (
    id           varchar(64) primary key,
    uri          varchar(2048),
    created_at   timestamptz not null,
    updated_at   timestamptz,
    grp          varchar(200) not null default '',
    note         text,
    honorific    varchar(60),
    title        varchar(120),
    given_name   varchar(200),
    family_name  varchar(200),
    company      varchar(300),
    department   varchar(300),
    street       varchar(300),
    house_number varchar(40),
    extra        varchar(300),
    postal_code  varchar(40),
    city         varchar(200),
    region       varchar(100),
    country      char(2) not null
);

create table inventory_item (
    id         varchar(64) primary key,
    uri        varchar(2048),
    created_at timestamptz not null,
    updated_at timestamptz,
    asset_tag  varchar(100) not null default '',
    name       varchar(300) not null default '',
    category   varchar(200) not null default '',
    model      varchar(200),
    serial     varchar(200),
    location   varchar(300) not null default '',
    owner      varchar(200),
    purchased  varchar(10)
);

create table storage_location (
    id         varchar(64) primary key,
    uri        varchar(2048),
    created_at timestamptz not null,
    updated_at timestamptz,
    segments   jsonb not null default '[]',
    area       varchar(200) not null default '',
    contents   varchar(500) not null default '',
    arrow      varchar(10),
    sku        varchar(100)
);

create table recipe (
    id               varchar(64) primary key,
    uri              varchar(2048),
    created_at       timestamptz not null,
    updated_at       timestamptz,
    name             varchar(300) not null default '',
    category         varchar(200) not null default '',
    shelf_life_hours integer not null,
    storage          varchar(10) not null,
    allergens        jsonb not null default '[]'
);

create table sign (
    id         varchar(64) primary key,
    uri        varchar(2048),
    created_at timestamptz not null,
    updated_at timestamptz,
    title      varchar(500) not null default '',
    subtitle   varchar(500) not null default ''
);

-- Which entities are switched on, and where each one's records really live.
create table entity_settings (
    id          varchar(20) primary key,
    enabled     boolean not null,
    system_name varchar(200) not null default '',
    base_url    varchar(2048) not null default ''
);

create table printer (
    id           varchar(64) primary key,
    name         varchar(100) not null,
    model        varchar(60) not null,
    location     varchar(200) not null,
    connection   varchar(20) not null,
    status       varchar(20) not null,
    loaded_media varchar(20) not null,
    remaining    varchar(40)
);

create table print_job (
    id           uuid primary key,
    printer_id   varchar(64) not null,
    printer_name varchar(100) not null,
    media_id     varchar(20) not null,
    kind         varchar(20) not null,
    title        varchar(500) not null,
    total        integer not null,
    printed      integer not null,
    state        varchar(10) not null,
    error        varchar(1000),
    created_at   timestamptz not null
);

create index print_job_created on print_job (created_at desc);

-- The rendered PDF, kept apart so listing jobs never loads documents.
create table print_document (
    job_id uuid primary key references print_job (id) on delete cascade,
    pdf    bytea not null
);
