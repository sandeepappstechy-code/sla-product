<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('requirements_graph', function (Blueprint $table) {
            $table->string('category', 100)->nullable()->after('priority'); // Compliance, Functional, Security
        });
    }

    public function down(): void
    {
        Schema::table('requirements_graph', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
