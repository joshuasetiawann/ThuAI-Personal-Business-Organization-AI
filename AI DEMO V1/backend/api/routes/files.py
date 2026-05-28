"""
Files API Routes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
import aiofiles
from pathlib import Path
from services.file_service import file_manager
from config import settings

router = APIRouter()

class WriteFileRequest(BaseModel):
    path: str
    content: str

class CreateDocRequest(BaseModel):
    filename: str
    content: str
    doc_type: str = "txt"

class SearchRequest(BaseModel):
    query: str
    subdir: str = ""

@router.get("/list")
async def list_files(subdir: str = ""):
    return await file_manager.list_files(subdir)

@router.get("/read")
async def read_file(path: str):
    try:
        return await file_manager.read_file(path)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))

@router.post("/write")
async def write_file(req: WriteFileRequest):
    try:
        return await file_manager.write_file(req.path, req.content)
    except PermissionError as e:
        raise HTTPException(403, str(e))

@router.post("/create-document")
async def create_document(req: CreateDocRequest):
    return await file_manager.create_document(req.filename, req.content, req.doc_type)

@router.post("/search")
async def search_files(req: SearchRequest):
    return await file_manager.search_in_files(req.query, req.subdir)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    upload_dir = Path(settings.FILES_DIR) / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / file.filename
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    return {"success": True, "filename": file.filename, "path": f"uploads/{file.filename}", "size": len(content)}

@router.get("/info")
async def get_dir_info():
    return file_manager.get_dir_info()
