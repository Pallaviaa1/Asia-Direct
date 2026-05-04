------------------ Basic MongoDB Queries
Retrieve all documents from a collection named students.
Find students with age greater than 18.
Find documents where name is "Rahul".
Display only name and age fields (exclude _id).
Find students whose age is between 18 and 25.
------------------ Intermediate Queries
Find students whose course is either "BCA" or "MCA".
Sort students by age in descending order.
Count the number of students in the collection.
Find documents where name starts with "A".
Update a student's age where name is "Rahul".
Delete a document where age is less than 18.
Find students who have a field marks.
------------------  Advanced Queries
Use $and to find students with age > 18 AND marks > 70.
Use $or to find students in "BCA" or with marks > 80.
Find documents using $in operator for multiple values.
Use $lookup to join two collections (students and courses).
Aggregate total marks of all students using $group.
Find the average marks of students.
Use $limit and $skip for pagination.
Find the top 3 students with highest marks.
----------------- Scenario-Based Questions
Design a query to find duplicate records based on email.
Retrieve the second highest salary from an employees collection.
Find users who registered in the last 7 days.
Get students who scored above average marks.
Find documents where an array field contains a specific value.
--------------- Challenge Questions
Write a query to unwind an array field using $unwind.
Use $project to reshape documents.
Find the most frequent course chosen by students.
Perform a text search on description field.
Optimize a slow query using indexing (conceptual question).