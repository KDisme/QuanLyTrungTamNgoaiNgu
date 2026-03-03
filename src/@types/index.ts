// src/@types/index.ts
export interface TeacherItem {
    id: number;
    full_name: string;
    phone: string;
    email: string;
    date_of_birth: string;
    class_count: number;
    maGV?: string;
}

export interface StudentItem {
    id: number;
    name: string;
    email: string;
    birth_date: string;
    citizen_id: string;
    target_score: number;
    created_at: string;
}

export interface ClassItem {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    capacity: number;
    sessions: number;
    hv_count?: number;
}