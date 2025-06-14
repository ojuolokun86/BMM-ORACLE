-- USERS TABLE
create table if not exists users (
    user_id text primary key,
    name text,
    lid text,
    id text,
    date_created timestamptz,
    is_first_time boolean default true,
    auth_id text,
    prefix text default '.',
    tagformat boolean default true,
    format_response boolean default true,
    status_seen boolean default false,
    status_react boolean default false,
    max_ram integer default 10,
    max_rom integer default 200,
    username text
);

-- USER AUTH TABLE
create table if not exists user_auth (
    id serial primary key,
    email text unique not null,
    password text not null,
    auth_id text unique not null,
    subscription_status text
);

-- SUBSCRIPTION TOKENS
create table if not exists subscription_tokens (
    id serial primary key,
    user_auth_id text not null references user_auth(auth_id),
    token text,
    subscription_level text default 'free',
    expiration_date timestamptz
);

-- SESSIONS TABLE
create table if not exists sessions (
    phoneNumber text primary key,
    authId text,
    creds jsonb,
    keys jsonb
);

-- WELCOME SETTINGS
create table if not exists welcome_settings (
    group_id text not null,
    bot_instance_id text not null,
    is_enabled boolean default false,
    welcome_message text,
    primary key (group_id, bot_instance_id)
);

-- GROUP SETTINGS
create table if not exists group_settings (
    group_id text not null,
    bot_instance_id text not null,
    warning_threshold integer default 3,
    primary key (group_id, bot_instance_id)
);

-- WARNINGS
create table if not exists warnings (
    group_id text not null,
    user_id text not null,
    reason text,
    warning_count integer default 1,
    bot_instance_id text not null,
    updated_at timestamptz default now(),
    primary key (group_id, user_id, bot_instance_id)
);

-- ANTIDELETE SETTINGS
create table if not exists antidelete_settings (
    group_id text not null,
    bot_instance_id text not null,
    is_enabled boolean default false,
    is_global boolean default false,
    primary key (group_id, bot_instance_id)
);

-- ANTILINK SETTINGS
create table if not exists antilink_settings (
    group_id text not null,
    user_id text not null,
    antilink_enabled boolean default false,
    warning_count integer default 3,
    bypass_admin boolean default false,
    bypass_users jsonb default '[]',
    primary key (group_id, user_id)
);

-- NOTIFICATIONS
create table if not exists notifications (
    id serial primary key,
    message text not null,
    target_auth_id text,
    sender text default 'Admin',
    timestamp timestamptz default now()
);

-- NOTIFICATION READS
create table if not exists notification_reads (
    id serial primary key,
    notification_id integer references notifications(id),
    auth_id text,
    read_at timestamptz default now()
);

-- COMPLAINTS
create table if not exists complaints (
    id serial primary key,
    auth_id text not null,
    message text not null,
    timestamp timestamptz default now()
);

-- GROUP MODES
create table if not exists group_modes (
    user_id text not null,
    group_id text not null,
    mode text default 'all',
    updated_at timestamptz default now(),
    primary key (user_id, group_id)
);

-- ANNOUNCEMENTS
create table if not exists announcements (
    group_id text not null,
    bot_instance_id text not null,
    interval integer not null,
    message text,
    primary key (group_id, bot_instance_id)
);

-- SECURITY LOGS
create table if not exists security_logs (
    id serial primary key,
    auth_id text,
    event text,
    created_at timestamptz default now()
);