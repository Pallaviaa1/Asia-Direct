SELECT name 
FROM users 
WHERE id IN (
  SELECT user_id 
  FROM orders 
  WHERE total > 1000
);

select name from users where id in(select user_id fromm users where total ? 10000)