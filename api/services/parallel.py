"""Cancel sibling provider queries when one fails or the deadline expires."""
import asyncio


async def gather_queries(*queries):
    async with asyncio.TaskGroup() as group:
        tasks = [group.create_task(query) for query in queries]
    return [task.result() for task in tasks]
