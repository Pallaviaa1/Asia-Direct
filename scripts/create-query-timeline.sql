CREATE TABLE IF NOT EXISTS tbl_query_timeline (
  id int(11) NOT NULL AUTO_INCREMENT,
  query_id int(11) NOT NULL,
  stage varchar(100) NOT NULL,
  outcome varchar(100) DEFAULT NULL,
  note text DEFAULT NULL,
  updated_by int(11) DEFAULT NULL,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_query_timeline_query (query_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
