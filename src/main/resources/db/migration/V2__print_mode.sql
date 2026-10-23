-- How the job's PDF was made: the server places 300 dpi rasters, or the
-- client sends vector outlines for the driver to rasterize.
alter table print_job add column render_mode varchar(10) not null default 'raster';
